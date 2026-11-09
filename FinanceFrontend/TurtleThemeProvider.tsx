import React from "react";
import { ConfigProvider, theme as antdTheme } from "antd";

import { useThemeInit } from "@Turtle/Theme/useTurleTheme";
import {
    ACCENT,
    FONT_MONO,
    FONT_SANS,
    INK,
    INK_SOFT,
    LOSS,
    MUTED,
    PAPER,
    PAPER_RAISED,
    PAPER_SUNK,
    RULE,
    GAIN,
} from "./src/TurtleFinance/Report/ReportTokens";

// TurtleThemeProvider configures antd as a printed research note:
// paper + ink, hairline rules, square corners, no shadows, no motion.
export default function TurtleThemeProvider({ children }) {
    const initTheme = useThemeInit();

    React.useEffect(() => {
        initTheme();
    }, []);

    return (
        <ConfigProvider
            theme={{
                algorithm: antdTheme.defaultAlgorithm,
                token: {
                    colorPrimary: INK,
                    colorInfo: INK,
                    colorLink: INK,
                    colorLinkHover: ACCENT,
                    colorSuccess: GAIN,
                    colorError: LOSS,
                    colorWarning: ACCENT,
                    colorText: INK,
                    colorTextSecondary: INK_SOFT,
                    colorTextTertiary: MUTED,
                    colorTextDescription: MUTED,
                    colorBorder: RULE,
                    colorBorderSecondary: RULE,
                    colorSplit: RULE,
                    colorBgLayout: PAPER,
                    colorBgContainer: PAPER_RAISED,
                    colorBgElevated: PAPER_RAISED,
                    colorFillAlter: PAPER_SUNK,
                    colorFillSecondary: PAPER_SUNK,
                    colorFillTertiary: PAPER_SUNK,
                    controlItemBgHover: PAPER_SUNK,
                    controlItemBgActive: "#efe6d4",
                    controlOutline: "transparent",
                    fontFamily: FONT_SANS,
                    fontFamilyCode: FONT_MONO,
                    fontSize: 13,
                    borderRadius: 0,
                    borderRadiusLG: 0,
                    borderRadiusSM: 0,
                    borderRadiusXS: 0,
                    boxShadow: "none",
                    boxShadowSecondary: "0 0 0 1px " + INK,
                    boxShadowTertiary: "none",
                    motion: false,
                    wireframe: true,
                },
                components: {
                    Button: {
                        primaryShadow: "none",
                        defaultShadow: "none",
                        dangerShadow: "none",
                        defaultBorderColor: INK,
                        defaultColor: INK,
                        defaultBg: "transparent",
                        fontWeight: 500,
                    },
                    Table: {
                        headerBg: "transparent",
                        headerColor: INK,
                        headerSplitColor: "transparent",
                        borderColor: RULE,
                        rowHoverBg: PAPER_SUNK,
                        rowSelectedBg: "#efe6d4",
                        rowSelectedHoverBg: "#e9dcc3",
                        cellPaddingBlockSM: 4,
                        cellPaddingInlineSM: 6,
                        cellPaddingBlock: 7,
                        headerSortActiveBg: "transparent",
                        headerSortHoverBg: PAPER_SUNK,
                        bodySortBg: "transparent",
                        fixedHeaderSortActiveBg: PAPER,
                    },
                    Tabs: {
                        inkBarColor: ACCENT,
                        itemSelectedColor: INK,
                        itemHoverColor: INK,
                        itemColor: MUTED,
                        horizontalItemGutter: 24,
                    },
                    Tag: { defaultBg: "transparent" },
                    Form: { itemMarginBottom: 10, labelColor: INK_SOFT },
                    Modal: { contentBg: PAPER_RAISED, headerBg: PAPER_RAISED, footerBg: PAPER_RAISED },
                    Drawer: { colorBgElevated: PAPER_RAISED },
                    Progress: { defaultColor: INK, remainingColor: RULE },
                    Segmented: { itemSelectedBg: INK, itemSelectedColor: PAPER, trackBg: "transparent" },
                    Switch: { colorPrimary: INK },
                    Slider: { trackBg: INK, handleColor: INK, railBg: RULE },
                },
            }}
        >
            {React.Children.only(children)}
        </ConfigProvider>
    );
}
