import React from "react";
import {
    AutoComplete,
    Checkbox,
    Flex,
    Input,
    Modal,
    Typography,
    message,
} from "antd";
import { useTranslation } from "react-i18next";

import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import Company, { SearchHit } from "@TurtleFinance/Data/Company";

interface AddCompanyModalProps {
    open: boolean;
    onClose: () => void;
    onAdded: (company: Company) => void;
}

// AddCompanyModal: live ticker search (Yahoo /search) + "sync prices" option.
export default function AddCompanyModal({
    open,
    onClose,
    onAdded,
}: AddCompanyModalProps) {
    const [t] = useTranslation();
    const [ticker, setTicker] = React.useState("");
    const [hits, setHits] = React.useState<SearchHit[]>([]);
    const [sync, setSync] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const searchSeq = React.useRef(0);

    React.useEffect(() => {
        if (open) {
            setTicker("");
            setHits([]);
        }
    }, [open]);

    React.useEffect(() => {
        const q = ticker.trim();
        if (q.length < 1) {
            setHits([]);
            return;
        }
        const seq = ++searchSeq.current;
        const timer = setTimeout(async () => {
            try {
                const res = await CompaniesApi.Search(q);
                if (seq === searchSeq.current) setHits(res);
            } catch {
                // search is best effort
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [ticker]);

    async function submit() {
        const symbol = ticker.trim().toUpperCase();
        if (!symbol) return;
        setSaving(true);
        try {
            const company = await CompaniesApi.Add(symbol, sync);
            message.success(
                sync
                    ? `${company.ticker || symbol} added – downloading up to 15 years of prices in the background`
                    : `${company.ticker || symbol} added without prices`,
            );
            onAdded(company);
            onClose();
        } catch {
            // the Turxios interceptor already shows the backend error text
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            title={"Add a ticker"}
            open={open}
            onCancel={onClose}
            onOk={submit}
            okText={ticker.trim() ? `Add ${ticker.trim().toUpperCase()}` : "Add"}
            okButtonProps={{ disabled: !ticker.trim() }}
            confirmLoading={saving}
            destroyOnHidden
        >
            <Flex vertical gap={12}>
                <Typography.Text type={"secondary"}>
                    Type a ticker or a company name. Non-US listings need the exchange suffix: SAP.DE (Xetra), NESN.SW
                    (SIX), ULVR.L (London).
                </Typography.Text>
                <AutoComplete
                    value={ticker}
                    onChange={(v) => setTicker(v)}
                    onSelect={(v) => setTicker(v)}
                    options={hits.map((h) => ({
                        value: h.symbol,
                        label: (
                            <Flex justify={"space-between"} gap={8}>
                                <span>
                                    <b>{h.symbol}</b> {h.name}
                                </span>
                                <span className={"tf-mono"} style={{ fontSize: 11, color: "#86827a" }}>
                                    {h.exchange}
                                    {h.quoteType && ` · ${h.quoteType.toLowerCase()}`}
                                </span>
                            </Flex>
                        ),
                    }))}
                    style={{ width: "100%" }}
                >
                    <Input.Search
                        placeholder={"KO, Nestlé, SAP.DE"}
                        onSearch={submit}
                        enterButton={false}
                        autoFocus
                    />
                </AutoComplete>
                <Checkbox checked={sync} onChange={(e) => setSync(e.target.checked)}>
                    Download price history now (one request per ticker, ~2 s)
                </Checkbox>
            </Flex>
        </Modal>
    );
}
