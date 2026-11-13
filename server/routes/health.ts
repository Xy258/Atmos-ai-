import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "../api-zod/index.ts";

const router: IRouter = Router();

router.get(["/healthz", "/health"], (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
