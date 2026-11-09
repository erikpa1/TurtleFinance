import ReactApexChart from "react-apexcharts";

import { reportChartOptions } from "@TurtleFinance/Report/reportChart";

// Chart wraps react-apexcharts and applies the report chart style
// (Report/reportChart.ts) to every chart in the app.
export default function Chart(props: {
    type: string;
    series: any[];
    options: any;
    height?: number | string;
    width?: number | string;
}) {
    const Comp: any = ReactApexChart;
    return (
        <Comp
            type={props.type}
            series={props.series}
            options={reportChartOptions(props.type, props.options)}
            height={props.height ?? 300}
            width={props.width ?? "100%"}
        />
    );
}
