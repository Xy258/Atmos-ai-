import { Router, type IRouter } from "express";
import healthRouter from "./health.ts";
import weatherRouter from "./weather.ts";
import waterQualityRouter from "./waterQuality.ts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weatherRouter);
router.use(waterQualityRouter);

export default router;
