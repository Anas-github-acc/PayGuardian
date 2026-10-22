import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

const app = buildApp({ logger: false });
let ready: PromiseLike<unknown> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= app.ready().then(() => undefined);
  await ready;
  app.server.emit("request", req, res);
}
