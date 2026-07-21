import env from "./config/env";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
