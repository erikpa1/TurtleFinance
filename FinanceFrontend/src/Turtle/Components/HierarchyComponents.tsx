import React from "react";
import { Flex } from "antd";

export function HierarchyRightFlex({ children }: React.PropsWithChildren) {
    return (
        <Flex align={"center"} justify="end" flex={1} gap={5}>
            {children}
        </Flex>
    );
}
