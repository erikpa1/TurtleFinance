import React from "react";
import { Select } from "antd";

import AiApi from "@TurtleFinance/Data/AiApi";

// ModelSelect lists the locally available Ollama models. Empty value = use the
// default model from settings.
export default function ModelSelect({
    value,
    onChange,
    style,
}: {
    value?: string;
    onChange?: (v: string) => void;
    style?: React.CSSProperties;
}) {
    const [models, setModels] = React.useState<string[]>([]);
    const [defaultModel, setDefaultModel] = React.useState("");

    React.useEffect(() => {
        AiApi.Status()
            .then((s) => {
                setModels((s?.models ?? []).map((m) => m.name));
                setDefaultModel(s?.defaultModel ?? "");
            })
            .catch(() => {});
    }, []);

    return (
        <Select
            allowClear
            showSearch
            style={{ minWidth: 200, ...style }}
            placeholder={defaultModel ? `default: ${defaultModel}` : "model"}
            value={value || undefined}
            onChange={(v) => onChange?.(v ?? "")}
            options={models.map((m) => ({ value: m, label: m }))}
        />
    );
}
