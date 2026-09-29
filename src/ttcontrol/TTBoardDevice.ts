// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2024, Tiny Tapeout LTD

import { createStore } from 'solid-js/store';
import { LineBreakTransformer } from '~/utils/LineBreakTransformer';
import ttControl from './ttcontrol.py?raw';

export interface ILogEntry {
  sent: boolean;
  text: string;
}

export type WriteStatus = 'idle' | 'writing' | 'ok' | 'fail';

export interface IWriteState {
  status: WriteStatus;
  message: string;
  bytes: number;
}

const MAX_LOG_ENTRIES = 1000;
const BASE64_CHUNK_SIZE = 1024; // Must be a multiple of 4
const CONFIG_PATH = '/config.ini';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export class TTBoardDevice extends EventTarget {
  private reader?: ReadableStreamDefaultReader<string>;
  private readableStreamClosed?: Promise<void>;
  private writableStreamClosed?: Promise<void>;
  private writer?: WritableStreamDefaultWriter<string>;
  private expectedBase64: string | null = null;
  private closed = false;

  readonly data;
  private setData;

  constructor(readonly port: SerialPort) {
    super();
    const [data, setData] = createStore({
      boot: false,
      version: null as string | null,
      shuttle: null as string | null,
      logs: [] as ILogEntry[],
      write: { status: 'idle', message: '', bytes: 0 } as IWriteState,
    });
    this.data = data;
    this.setData = setData;
  }

  private addLogEntry(entry: ILogEntry) {
    const newLogs = [...this.data.logs, entry];
    if (newLogs.length > MAX_LOG_ENTRIES) {
      newLogs.shift();
    }
    this.setData('logs', newLogs);
  }

  async sendCommand(command: string, log = true) {
    if (log) {
      this.addLogEntry({ text: command, sent: true });
    }
    await this.writer?.write(`${command}\x04`);
  }

  /**
   * Overwrites config.ini on the board with the given content, then reads it back
   * so the result can be verified (reported via `data.write`).
   */
  async writeConfigFile(content: string) {
    const bytes = new TextEncoder().encode(content);
    const b64 = toBase64(bytes);
    this.expectedBase64 = b64;
    this.setData('write', { status: 'writing', message: '', bytes: bytes.length });

    const chunks: string[] = [];
    for (let i = 0; i < b64.length; i += BASE64_CHUNK_SIZE) {
      chunks.push(b64.slice(i, i + BASE64_CHUNK_SIZE));
    }
    const script = [
      'import binascii',
      'try:',
      `  f = open('${CONFIG_PATH}', 'wb')`,
      ...chunks.map((chunk) => `  f.write(binascii.a2b_base64('${chunk}'))`),
      '  f.close()',
      `  f = open('${CONFIG_PATH}', 'rb')`,
      "  print('cfg_readback=' + binascii.b2a_base64(f.read()).decode().strip())",
      '  f.close()',
      'except Exception as e:',
      "  print('cfg_error=' + str(e))",
    ].join('\n');

    this.addLogEntry({ text: `<<< write ${CONFIG_PATH} (${bytes.length} bytes) >>>`, sent: true });
    await this.sendCommand(script, false);
  }

  private processInput(line: string) {
    if (line.startsWith('BOOT: ')) {
      this.setData('boot', true);
      return;
    }

    const [name, value = ''] = line.trim().split(/=(.+)/);
    switch (name) {
      case 'tt.sdk_version':
        this.setData('version', value.replace(/^release_v/, ''));
        break;

      case 'shuttle':
        this.setData('shuttle', value);
        break;

      case 'cfg_readback': {
        if (this.data.write.status !== 'writing') {
          break;
        }
        const ok = value.trim() === this.expectedBase64;
        this.setData('write', {
          status: ok ? 'ok' : 'fail',
          message: ok ? '' : 'Read-back contents do not match what was written',
        });
        this.expectedBase64 = null;
        break;
      }

      case 'cfg_error':
        this.setData('write', { status: 'fail', message: value });
        this.expectedBase64 = null;
        break;
    }
  }

  async start() {
    void this.run();

    const textEncoderStream = new TextEncoderStream();
    this.writer = textEncoderStream.writable.getWriter();
    this.writableStreamClosed = textEncoderStream.readable.pipeTo(this.port.writable);
    if (this.data.version == null) {
      await this.writer.write('\n'); // Send a newlines to get REPL prompt.
      await this.writer.write('print(f"tt.sdk_version={tt.version}")\r\n');
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for the response.
    }
    if (this.data.boot) {
      // Wait for the board to finish booting, up to 6 seconds:
      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (this.data.version) {
          break;
        }
      }
    }
    if (this.data.version == null) {
      // The following sequence tries to ensure clean reboot:
      // Send Ctrl+C twice to stop any running program,
      // followed by Ctrl+B to exit RAW REPL mode (if it was entered),
      // and finally Ctrl+D to soft reset the board.
      await this.writer.write('\x03\x03\x02');
      await this.writer.write('\x04');
    }
    await this.writer.write('\x01'); // Send Ctrl+A to enter RAW REPL mode.
    await this.writer.write(ttControl + '\x04'); // Send the ttcontrol.py script and execute it.
    await this.sendCommand('read_rom()');
  }

  private async run() {
    const { port } = this;

    function cleanupRawREPL(value: string) {
      /* eslint-disable no-control-regex */
      return (
        value
          // Remove the OK responses:
          .replace(/^(\x04*>OK)+\x04*/, '')
          // Remove ANSI escape codes:
          .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      );
      /* eslint-enable no-control-regex */
    }

    while (port.readable && !this.closed) {
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable
        .pipeThrough(new TransformStream(new LineBreakTransformer()))
        .getReader();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) {
            this.reader.releaseLock();
            return;
          }
          if (value) {
            const cleanValue = cleanupRawREPL(value);
            this.processInput(cleanValue);
            this.addLogEntry({
              text: cleanValue.startsWith('cfg_readback=')
                ? `cfg_readback=<${cleanValue.length - 13} chars>`
                : cleanValue,
              sent: false,
            });
          }
        }
      } catch (error) {
        console.error('SerialReader error:', error);
        this.dispatchEvent(new Event('close'));
      } finally {
        this.reader.releaseLock();
      }
    }
  }

  /** Soft-resets the board so it boots with the new config, then disconnects. */
  async reboot() {
    await this.close(true);
  }

  async close(reboot = false) {
    this.closed = true;
    await this.reader?.cancel();
    await this.readableStreamClosed?.catch(() => {});

    try {
      await this.writer?.write('\x03\x03\x02'); // Stop any running code and exit the RAW REPL mode.
      if (reboot) {
        await this.writer?.write('\x04'); // Ctrl+D: soft reset.
      }
    } catch (e) {
      console.warn('Failed to exit RAW REPL mode:', e);
    }

    await this.writer?.close();
    await this.writableStreamClosed?.catch(() => {});

    await this.port.close();
    this.dispatchEvent(new Event('close'));
  }
}
