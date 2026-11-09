import { Route } from "react-router-dom";
import React from "react";

const DashboardDock = React.lazy(
    () => import("@TurtleFinance/Dashboard/DashboardDock"),
);
const CompaniesDock = React.lazy(
    () => import("@TurtleFinance/Companies/CompaniesDock"),
);
const CompanyDetailDock = React.lazy(
    () => import("@TurtleFinance/Companies/CompanyDetailDock"),
);
const ScreenerDock = React.lazy(
    () => import("@TurtleFinance/Screener/ScreenerDock"),
);
const IndexesDock = React.lazy(
    () => import("@TurtleFinance/Indexes/IndexesDock"),
);
const ForecastLabDock = React.lazy(
    () => import("@TurtleFinance/ForecastLab/ForecastLabDock"),
);
const CategoriesDock = React.lazy(
    () => import("@TurtleFinance/Categories/CategoriesDock"),
);
const FactorsDock = React.lazy(() => import("@TurtleFinance/Factors/FactorsDock"));
const StrategiesDock = React.lazy(() => import("@TurtleFinance/Strategies/StrategiesDock"));
const LedgerDock = React.lazy(() => import("@TurtleFinance/Ledger/LedgerDock"));
const DataUsageDock = React.lazy(() => import("@TurtleFinance/Market/DataUsageDock"));
const TagsDock = React.lazy(() => import("@TurtleFinance/Tags/TagsDock"));
const AiDock = React.lazy(() => import("@TurtleFinance/Ai/AiDock"));
const JobsDock = React.lazy(() => import("@TurtleFinance/Jobs/JobsDock"));
const SettingsDock = React.lazy(
    () => import("@TurtleFinance/Settings/SettingsDock"),
);

export default function FinanceRoutes() {
    return [
        <Route key={"dashboard"} path={"/"} element={<DashboardDock />} />,
        <Route
            key={"companies"}
            path={"/companies"}
            element={<CompaniesDock />}
        />,
        <Route
            key={"company"}
            path={"/companies/:companyUid"}
            element={<CompanyDetailDock />}
        />,
        <Route
            key={"company-tab"}
            path={"/companies/:companyUid/:tab"}
            element={<CompanyDetailDock />}
        />,
        <Route key={"screener"} path={"/screener"} element={<ScreenerDock />} />,
        <Route key={"indexes"} path={"/indexes"} element={<IndexesDock />} />,
        <Route
            key={"forecast-lab"}
            path={"/forecast-lab"}
            element={<ForecastLabDock />}
        />,
        <Route
            key={"categories"}
            path={"/categories"}
            element={<CategoriesDock />}
        />,
        <Route key={"factors"} path={"/factors"} element={<FactorsDock />} />,
        <Route key={"strategies"} path={"/strategies"} element={<StrategiesDock />} />,
        <Route key={"ledger"} path={"/ledger"} element={<LedgerDock />} />,
        <Route key={"data-usage"} path={"/data-usage"} element={<DataUsageDock />} />,
        <Route key={"tags"} path={"/tags"} element={<TagsDock />} />,
        <Route key={"ai"} path={"/ai"} element={<AiDock />} />,
        <Route key={"jobs"} path={"/jobs"} element={<JobsDock />} />,
        <Route key={"settings"} path={"/settings"} element={<SettingsDock />} />,
    ];
}
