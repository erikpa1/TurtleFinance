import React from "react";
import { Form, Modal, Select, message } from "antd";
import { useTranslation } from "react-i18next";

import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import Tag from "@TurtleFinance/Data/Tag";

export default function BulkTagsModal({
    open,
    uids,
    tags,
    onClose,
    onDone,
}: {
    open: boolean;
    uids: string[];
    tags: Map<string, Tag>;
    onClose: () => void;
    onDone: () => void;
}) {
    const [t] = useTranslation();
    const [add, setAdd] = React.useState<string[]>([]);
    const [remove, setRemove] = React.useState<string[]>([]);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setAdd([]);
            setRemove([]);
        }
    }, [open]);

    const options = [...tags.values()].map((tg) => ({
        value: tg.uid,
        label: tg.name,
    }));

    async function submit() {
        setSaving(true);
        try {
            await CompaniesApi.UpdateTags(uids, add, remove);
            message.success(`Tags updated on ${uids.length} companies (+${add.length} / −${remove.length})`);
            onDone();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            title={`${t("Tag")} ${uids.length} ${t("companies")}`}
            open={open}
            onCancel={onClose}
            onOk={submit}
            confirmLoading={saving}
            okText={`Apply to ${uids.length} companies`}
            okButtonProps={{ disabled: add.length + remove.length === 0 }}
        >
            <Form layout={"vertical"}>
                <Form.Item label={t("Add tags")}>
                    <Select
                        mode={"multiple"}
                        value={add}
                        onChange={setAdd}
                        options={options}
                        optionFilterProp={"label"}
                    />
                </Form.Item>
                <Form.Item label={t("Remove tags")}>
                    <Select
                        mode={"multiple"}
                        value={remove}
                        onChange={setRemove}
                        options={options}
                        optionFilterProp={"label"}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
