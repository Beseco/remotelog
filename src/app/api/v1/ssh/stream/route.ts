import { NextRequest } from "next/server";
import { Client } from "ssh2";
import { sshSessions } from "../connect/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Map from session token → active SSH shell stream (used by /input)
declare global {
  // eslint-disable-next-line no-var
  var __sshShells: Map<string, import("stream").Writable> | undefined;
  // eslint-disable-next-line no-var
  var __sshKbHandlers: Map<string, (input: string) => void> | undefined;
}
globalThis.__sshShells ??= new Map();
globalThis.__sshKbHandlers ??= new Map();
export const sshShells: Map<string, import("stream").Writable> = globalThis.__sshShells;
export const sshKbHandlers: Map<string, (input: string) => void> = globalThis.__sshKbHandlers;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) return new Response("token required", { status: 400 });

  const creds = sshSessions.get(token);
  if (!creds || creds.expiresAt < Date.now()) {
    sshSessions.delete(token);
    return new Response("Session abgelaufen oder ungültig", { status: 410 });
  }

  // Mark session as consumed
  sshSessions.delete(token);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const ssh = new Client();

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* controller closed */ }
      };

      ssh.on("ready", () => {
        ssh.shell({ term: "xterm-256color", rows: 24, cols: 80 }, (err, shellStream) => {
          if (err) {
            send(`\r\nFehler: ${err.message}\r\n`);
            controller.close();
            return;
          }

          sshShells.set(token, shellStream as unknown as import("stream").Writable);

          shellStream.on("data", (chunk: Buffer) => send(chunk.toString("utf8")));
          shellStream.stderr?.on("data", (chunk: Buffer) => send(chunk.toString("utf8")));
          shellStream.on("close", () => {
            sshShells.delete(token);
            try { controller.close(); } catch { /* already closed */ }
            ssh.end();
          });
        });
      });

      ssh.on("keyboard-interactive", (_name, _instructions, _lang, prompts, finish) => {
        if (prompts.length === 0) { finish([]); return; }

        const answers: string[] = [];
        let currentAnswer = "";
        let idx = 0;

        send(`\r\n${prompts[0].prompt}`);

        sshKbHandlers.set(token, (input: string) => {
          for (const ch of input) {
            if (ch === "\r" || ch === "\n") {
              answers.push(currentAnswer);
              currentAnswer = "";
              idx++;
              if (idx >= prompts.length) {
                sshKbHandlers.delete(token);
                send("\r\n");
                finish(answers);
              } else {
                send(`\r\n${prompts[idx].prompt}`);
              }
            } else if (ch === "\x7f" || ch === "\x08") {
              if (currentAnswer.length > 0) {
                currentAnswer = currentAnswer.slice(0, -1);
                if (prompts[idx].echo) send("\x08 \x08");
              }
            } else {
              currentAnswer += ch;
              if (prompts[idx].echo) send(ch);
            }
          }
        });
      });

      ssh.on("error", (err) => {
        sshKbHandlers.delete(token);
        send(`\r\nVerbindungsfehler: ${err.message}\r\n`);
        sshShells.delete(token);
        try { controller.close(); } catch { /* already closed */ }
      });

      ssh.connect({
        host: creds.host,
        port: creds.port,
        username: creds.username,
        ...(creds.privateKey
          ? { privateKey: creds.privateKey }
          : { password: creds.password }),
        tryKeyboard: true,
        readyTimeout: 15_000,
      });
    },
    cancel() {
      sshShells.delete(token);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
