import TurtleColors from "@Turtle/Constants/TurtleColors";

export class TurtleThemeLight {
    uid = "";
    name = "";
    default = false;
    color = TurtleColors.AZURE_BLUE;
}

// TurtleTheme mirrors the Intelligence theme entity. Finance has no theme
// backend yet, so the defaults below are the active theme.
export class TurtleTheme extends TurtleThemeLight {
    title = "Turtle Finance";
    favicon = "/icons/turtle-finance.svg";
    primaryLogo = "/icons/turtle-finance.svg";
    primaryLogoSizeX = "40px";
    primaryLogoSizeY = "40px";
    topBarHeightBig = "45px";
    bigPadding = "15px";
    headingFontColor = TurtleColors.AZURE_BLUE;
    iconPrimaryColor = TurtleColors.AZURE_BLUE;
    primaryColor = TurtleColors.AZURE_BLUE;
    iconSecondaryColor = TurtleColors.GRAY;
    borderColor = TurtleColors.AZURE_BLUE;
    borderHoverColor = TurtleColors.AZURE_BLUE_HOVER;

    GetSplitterBigHeight(): string {
        return `calc(100vh - ${this.topBarHeightBig})`;
    }

    GetSpliterContentHeight(): string {
        return `calc(100% - ${this.topBarHeightBig})`;
    }
}
