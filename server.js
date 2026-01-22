import "dotenv/config";
console.log("MONGO_URL after config:", process.env.MONGO_URL);

import { app } from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`server listening on port ${PORT}`);
});