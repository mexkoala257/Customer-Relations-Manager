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
import exportRouter from "./export";
import userReminderPrefsRouter from "./user-reminder-prefs";
import bugReportsRouter from "./bug-reports";
import watchersRouter from "./watchers";
import emailLogsRouter from "./email-logs";

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
router.use(exportRouter);
router.use(userReminderPrefsRouter);
router.use(bugReportsRouter);
router.use(watchersRouter);
router.use(emailLogsRouter);

export default router;
