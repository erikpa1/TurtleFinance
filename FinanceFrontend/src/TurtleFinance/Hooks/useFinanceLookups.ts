import React from "react";

import TagsApi from "@TurtleFinance/Data/TagsApi";
import CategoriesApi from "@TurtleFinance/Data/CategoriesApi";
import Tag from "@TurtleFinance/Data/Tag";
import Category from "@TurtleFinance/Data/Category";

// useFinanceLookups loads tags (by uid) and categories (by key) used to render
// chips everywhere companies are listed.
export function useFinanceLookups() {
    const [tags, setTags] = React.useState<Map<string, Tag>>(new Map());
    const [categories, setCategories] = React.useState<Map<string, Category>>(
        new Map(),
    );

    const refresh = React.useCallback(async () => {
        const [t, c] = await Promise.all([
            TagsApi.ListAsMap().catch(() => new Map<string, Tag>()),
            CategoriesApi.ListAsMap().catch(() => new Map<string, Category>()),
        ]);
        setTags(t);
        setCategories(c);
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    return { tags, categories, refreshLookups: refresh };
}
