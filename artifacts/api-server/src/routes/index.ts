import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import customersRouter from "./customers";
import leadsRouter from "./leads";
import dashboardRouter from "./dashboard";
import remindersRouter from "./reminders";
import teamRouter from "./team";
import settingsRouter from "./settings";
import setupRouter from "./setup";

const router: IRouter = Router();

router.use(setupRouter);
router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(customersRouter);
router.use(leadsRouter);
router.use(dashboardRouter);
router.use(remindersRouter);
router.use(teamRouter);
router.use(settingsRouter);

export default router;
