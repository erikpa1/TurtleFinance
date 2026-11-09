import React from "react";

import { Alert } from "antd";
import AppNavBar, { NAVBAR_WIDTH } from "./AppNavBar";
import AppRoutes from "./AppRoutes";
import { TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";

export default function TurtleApp() {
    return (
        <div style={{ display: "flex", minHeight: "100dvh" }}>
            <AppNavBar />
            <main
                style={{
                    marginLeft: NAVBAR_WIDTH,
                    flexGrow: 1,
                    minWidth: 0,
                    overflowX: "hidden",
                }}
            >
                <Alert.ErrorBoundary>
                    <React.Suspense
                        fallback={
                            <div style={{ padding: 32 }}>
                                <TableSkeleton rows={10} />
                            </div>
                        }
                    >
                        <AppRoutes />
                    </React.Suspense>
                </Alert.ErrorBoundary>
            </main>
        </div>
    );
}
