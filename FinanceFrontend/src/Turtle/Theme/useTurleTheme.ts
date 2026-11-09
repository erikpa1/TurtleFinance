import { create } from "zustand";

import { TurtleTheme } from "@Turtle/Theme/theme";

interface TurtleThemeZus {
    bigPadding: string | number;
    theme: TurtleTheme;
    isLight: boolean;
    setTheme: (newTheme: TurtleTheme) => void;
    swapTheme: () => void;
}

export const useTurtleTheme = create<TurtleThemeZus>((set) => ({
    bigPadding: "15px",
    isLight: true,
    swapTheme: () =>
        set((oldState) => {
            return { isLight: !oldState.isLight };
        }),
    theme: new TurtleTheme(),
    setTheme: (obj: TurtleTheme) => set(() => ({ theme: obj })),
}));

export function useThemeInit(): () => void {
    const { theme } = useTurtleTheme();

    return () => {
        document.title = theme.title;
        const fav = document.getElementById("favico") as HTMLLinkElement;
        if (fav) fav.href = theme.favicon;
    };
}
