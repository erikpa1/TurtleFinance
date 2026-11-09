import { Routes } from "react-router-dom";

import FinanceRoutes from "@TurtleFinance/FinanceRoutes";

export default function AppRoutes() {
    return <Routes>{FinanceRoutes()}</Routes>;
}
