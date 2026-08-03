import "dotenv/config";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT) || 4000;
createApp().listen(port, () => {
  console.log(`✔ Lumen API listening on http://localhost:${port}`);
});
