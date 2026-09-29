// SPDX-License-Identifier: Apache-2.0

import { CheckCircle, Error, RestartAlt, Save } from '@suid/icons-material';
import {
  Box,
  Button,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@suid/material';
import { Show, createSignal } from 'solid-js';
import { configs } from '~/configs';
import { TTBoardDevice } from '~/ttcontrol/TTBoardDevice';
import { DebugLogs } from './DebugLogs';
import { LoadingButton } from './LoadingButton';

export interface IConfigWriterProps {
  device: TTBoardDevice;
}

export function ConfigWriter(props: IConfigWriterProps) {
  const [selectedId, setSelectedId] = createSignal(configs[0].id);
  const [showPreview, setShowPreview] = createSignal(false);
  const [showLogs, setShowLogs] = createSignal(false);

  const selectedConfig = () => configs.find((c) => c.id === selectedId()) ?? configs[0];
  const write = () => props.device.data.write;

  return (
    <Stack mt={2}>
      <Stack direction="row" spacing={1} marginBottom={2} alignItems="center">
        <Stack flex={1} marginRight={1}>
          <Typography>
            Shuttle: <strong>{props.device.data.shuttle ?? '<unknown>'}</strong>
          </Typography>
          <Typography>
            Firmware: <strong>{props.device.data.version ?? '<unknown>'}</strong>
          </Typography>
        </Stack>
        <Button onClick={() => props.device.close()} variant="outlined">
          Disconnect
        </Button>
      </Stack>

      <Paper sx={{ padding: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Choose a configuration
        </Typography>
        <RadioGroup value={selectedId()} onChange={(_, value) => setSelectedId(value)}>
          {configs.map((config) => (
            <FormControlLabel
              value={config.id}
              control={<Radio />}
              label={
                <Stack>
                  <Typography>{config.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {config.description}
                  </Typography>
                </Stack>
              }
            />
          ))}
        </RadioGroup>

        <Button size="small" onClick={() => setShowPreview(!showPreview())} sx={{ mt: 1 }}>
          {showPreview() ? 'Hide' : 'Show'} config.ini
        </Button>
        <Show when={showPreview()}>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: 12,
              background: '#f5f5f5',
              padding: 1,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {selectedConfig().content}
          </Box>
        </Show>

        <Stack direction="row" spacing={1} mt={2} alignItems="center">
          <LoadingButton
            onClick={() => props.device.writeConfigFile(selectedConfig().content)}
            variant="contained"
            startIcon={<Save />}
            loading={write().status === 'writing'}
          >
            Write to board
          </LoadingButton>
          <Typography variant="body2" color="text.secondary">
            This overwrites config.ini on the board.
          </Typography>
        </Stack>

        <Show when={write().status === 'ok'}>
          <Stack direction="row" spacing={1} mt={2} alignItems="center">
            <CheckCircle color="success" />
            <Typography flex={1}>Written &amp; verified ({write().bytes} bytes).</Typography>
            <Button
              onClick={() => props.device.reboot()}
              variant="outlined"
              startIcon={<RestartAlt />}
            >
              Reboot board
            </Button>
          </Stack>
        </Show>
        <Show when={write().status === 'fail'}>
          <Stack direction="row" spacing={1} mt={2} alignItems="center">
            <Error color="error" />
            <Typography color="error">Write failed: {write().message}</Typography>
          </Stack>
        </Show>
      </Paper>

      <Stack marginTop={1} direction="row">
        <Button size="small" onClick={() => setShowLogs(!showLogs())}>
          {showLogs() ? 'Hide' : 'Show'} debug log
        </Button>
      </Stack>
      <Show when={showLogs()}>
        <DebugLogs logs={props.device.data.logs} />
      </Show>
    </Stack>
  );
}
