import React from "react";
import { Button, Col, Dropdown, Flex, Popconfirm, Row, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { notifyJobProblem } from "@TurtleFinance/Report/notifyJobProblem";

import DockLayout from "@TurtleFinance/Common/DockLayout";
import { Panel } from "@TurtleFinance/Common/StatCard";
import JobProgress from "@TurtleFinance/Common/JobProgress";
import { SignedPct } from "@TurtleFinance/Common/Values";
import Category from "@TurtleFinance/Data/Category";
import CategoriesApi from "@TurtleFinance/Data/CategoriesApi";
import Company, { CategoryAssignment } from "@TurtleFinance/Data/Company";
import CompaniesApi from "@TurtleFinance/Data/CompaniesApi";
import { fmtMultiple } from "@TurtleFinance/Data/Format";
import { useJobPoller } from "@TurtleFinance/Hooks/useJobPoller";
import COUCategoryDrawer from "@TurtleFinance/Categories/COUCategoryDrawer";
import KeyFiguresStrip from "@TurtleFinance/Report/KeyFiguresStrip";
import ReportEmptyState from "@TurtleFinance/Report/ReportEmptyState";
import ReportErrorNote from "@TurtleFinance/Report/ReportErrorNote";
import { KeyFiguresSkeleton, TableSkeleton } from "@TurtleFinance/Report/ReportSkeletons";
import Ticker, { ClippedName } from "@TurtleFinance/Report/Ticker";
import { ACCENT_WASH, FONT_MONO, INK_SOFT, MUTED } from "@TurtleFinance/Report/ReportTokens";

const GROUPS = ["essentials", "vice", "strategic", "esg", "other"];

interface MemberRow {
    company: Company;
    assignment: CategoryAssignment;
}

// CategoriesDock manages the thematic categories the local LLM sorts companies
// into (basic food, critical infrastructure, addictive substances, ...).
export default function CategoriesDock() {
    const [t] = useTranslation();
    const navigate = useNavigate();
    const [categories, setCategories] = React.useState<Category[]>([]);
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<any>(null);
    const [selectedKey, setSelectedKey] = React.useState("");
    const [editing, setEditing] = React.useState<Category | null>(null);
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [jobUid, setJobUid] = React.useState("");

    const job = useJobPoller(jobUid, (j) => {
        if (j.status === "done") message.success(`Classification finished: ${j.message}`);
        else notifyJobProblem(j, "Classification failed");
        refresh();
    });

    async function refresh() {
        setLoading(true);
        try {
            const [cats, comps] = await Promise.all([CategoriesApi.List(), CompaniesApi.List()]);
            setCategories(cats);
            setCompanies(comps);
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        refresh();
    }, []);

    async function classify(onlyUnclassified: boolean) {
        const j = await CompaniesApi.ClassifyMany([], onlyUnclassified);
        setJobUid(j.uid);
        message.info(onlyUnclassified ? `Classifying ${unclassified} unclassified companies with Ollama` : `Reclassifying all ${companies.length} companies with Ollama`);
    }

    async function resetDefaults() {
        await CategoriesApi.ResetDefaults();
        message.success("Missing default categories restored; your own categories were kept");
        refresh();
    }

    async function remove(c: Category) {
        await CategoriesApi.Delete(c.uid);
        refresh();
    }

    function countOf(key: string): number {
        return companies.filter((c) => c.categories.some((a) => a.key === key)).length;
    }

    const members: MemberRow[] = React.useMemo(
        () =>
            companies
                .filter((c) => c.categories.some((a) => a.key === selectedKey))
                .map((c) => ({
                    company: c,
                    assignment: c.categories.find((a) => a.key === selectedKey)!,
                }))
                .sort((a, b) => b.assignment.confidence - a.assignment.confidence),
        [companies, selectedKey],
    );

    const columns: ColumnsType<Category> = [
        {
            title: t("Category"),
            dataIndex: "name",
            render: (v, r) => (
                <Space size={6}>
                    <span style={{ display: "inline-block", width: 8, height: 8, background: r.color || MUTED }} />
                    <b>{v}</b>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED }}>{r.key}</span>
                </Space>
            ),
        },
        {
            title: t("Group"),
            dataIndex: "group",
            width: 140,
            filters: GROUPS.map((g) => ({ text: t(`category.group.${g}`), value: g })),
            onFilter: (v, r) => r.group === v,
            render: (g) => <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_SOFT }}>{t(`category.group.${g}`)}</span>,
        },
        {
            title: "Prompt text",
            dataIndex: "description",
            render: (v) => <ClippedName max={340}>{v}</ClippedName>,
        },
        {
            title: t("Companies"),
            key: "count",
            width: 110,
            align: "right",
            sorter: (a, b) => countOf(a.key) - countOf(b.key),
            render: (_, r) => countOf(r.key),
        },
        {
            title: "",
            key: "actions",
            width: 150,
            render: (_, r) => (
                <Space onClick={(e) => e.stopPropagation()}>
                    <Button
                        size={"small"}
                        type={"link"}
                        onClick={() => {
                            setEditing(r);
                            setDrawerOpen(true);
                        }}
                    >
                        {t("Edit")}
                    </Button>
                    <Popconfirm
                        title={`Delete "${r.name}"?`}
                        description={`It is removed from ${countOf(r.key)} companies too.`}
                        okText={"Delete"}
                        okButtonProps={{ danger: true }}
                        onConfirm={() => remove(r)}
                    >
                        <Button size={"small"} type={"link"} danger>
                            {t("Delete")}
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const selectedCategory = categories.find((c) => c.key === selectedKey);
    const unclassified = companies.filter((c) => c.categories.length === 0).length;

    return (
        <DockLayout
            title={"Thematic categories"}
            deck={"The taxonomy your local Ollama model sorts companies into. The description of each category is pasted into the prompt word for word, so write it like a definition."}
            actions={
                <>
                    <Dropdown
                        menu={{
                            items: [
                                {
                                    key: "unc",
                                    label: `Classify the ${unclassified} unclassified`,
                                    disabled: unclassified === 0,
                                    onClick: () => classify(true),
                                },
                                { key: "all", label: `Reclassify all ${companies.length} companies`, onClick: () => classify(false) },
                            ],
                        }}
                    >
                        <Button loading={!!job && !job.isFinished} disabled={companies.length === 0}>
                            Run Ollama classification ▾
                        </Button>
                    </Dropdown>
                    <Popconfirm
                        title={"Restore the 25 built-in categories?"}
                        description={"Missing defaults are re-created; edited and custom categories stay as they are."}
                        onConfirm={resetDefaults}
                    >
                        <Button type={"link"}>Restore defaults</Button>
                    </Popconfirm>
                    <Button
                        type={"primary"}
                        onClick={() => {
                            setEditing(new Category());
                            setDrawerOpen(true);
                        }}
                    >
                        New category
                    </Button>
                </>
            }
        >
            {error && <ReportErrorNote error={error} title={"Categories did not load"} />}
            {job && !job.isFinished && <JobProgress job={job} />}

            {loading && categories.length === 0 ? (
                <KeyFiguresSkeleton count={4} />
            ) : (
                <KeyFiguresStrip
                    size={24}
                    figures={[
                        { label: "Categories", value: categories.length },
                        { label: "Companies classified", value: companies.length - unclassified, unit: `/ ${companies.length}` },
                        { label: "Waiting for Ollama", value: unclassified, tone: unclassified ? "accent" : undefined },
                        { label: "Vice-flagged companies", value: companies.filter((c) => c.categories.some((a) => categories.find((x) => x.key === a.key)?.group === "vice")).length, tone: "loss" },
                    ]}
                    footnote={"assignments below 35 % confidence are discarded · manual edits in a company's edit drawer override the model"}
                />
            )}

            {!loading && companies.length > 0 && unclassified === companies.length && (
                <ReportEmptyState
                    title={"No company has been classified yet."}
                    actions={
                        <Button type={"primary"} onClick={() => classify(true)}>
                            Classify all {companies.length} with Ollama
                        </Button>
                    }
                >
                    The job sends each company's name, sector, industry and description to your local model together with
                    this taxonomy, and stores up to six categories with a confidence and a one-line reason. Expect 5–40 s
                    per company on a laptop; nothing leaves your machine.
                </ReportEmptyState>
            )}

            {loading && categories.length === 0 && <TableSkeleton rows={12} columns={4} />}

            <Row gutter={[36, 28]}>
                <Col xs={24} xl={14}>
                    <Panel title={"Definitions · click a row to see its companies"}>
                        <Table<Category>
                            rowKey={"key"}
                            size={"small"}
                            columns={columns}
                            dataSource={categories}
                            pagination={false}
                            onRow={(r) => ({
                                onClick: () => setSelectedKey(r.key),
                                style: {
                                    cursor: "pointer",
                                    background: r.key === selectedKey ? ACCENT_WASH : undefined,
                                },
                            })}
                        />
                    </Panel>
                </Col>
                <Col xs={24} xl={10}>
                    <Panel
                        title={
                            selectedCategory ? `${selectedCategory.name} · ${members.length} companies` : "Members"
                        }
                    >
                        {!selectedCategory ? (
                            <span style={{ color: INK_SOFT, fontSize: 13 }}>
                                Pick a category on the left to list its companies with confidence, P/E and 1-year return.
                            </span>
                        ) : (
                            <Flex vertical gap={8}>
                                <Typography.Paragraph type={"secondary"} style={{ fontStyle: "italic" }}>
                                    “{selectedCategory.description}”
                                </Typography.Paragraph>
                                <Table<MemberRow>
                                    rowKey={(r) => r.company.uid}
                                    size={"small"}
                                    dataSource={members}
                                    pagination={{ pageSize: 20 }}
                                    rowClassName={() => "tf-row-link"}
                                    onRow={(r) => ({ onClick: () => navigate(`/companies/${r.company.uid}`) })}
                                    locale={{ emptyText: "No company carries this category yet." }}
                                    columns={[
                                        {
                                            title: t("Ticker"),
                                            key: "t",
                                            render: (_, r) => <Ticker>{r.company.ticker}</Ticker>,
                                        },
                                        { title: t("Name"), key: "n", ellipsis: true, render: (_, r) => r.company.name },
                                        {
                                            title: "Confidence",
                                            key: "c",
                                            align: "right",
                                            render: (_, r) => `${Math.round(r.assignment.confidence * 100)} %`,
                                        },
                                        {
                                            title: "P/E",
                                            key: "pe",
                                            align: "right",
                                            render: (_, r) => fmtMultiple(r.company.fundamentals.trailingPE),
                                        },
                                        {
                                            title: "1Y",
                                            key: "1y",
                                            align: "right",
                                            render: (_, r) => <SignedPct value={r.company.metrics.ret1Y} />,
                                        },
                                    ]}
                                    expandable={{
                                        expandedRowRender: (r) => (
                                            <Typography.Text type={"secondary"}>{r.assignment.reason}</Typography.Text>
                                        ),
                                        rowExpandable: (r) => !!r.assignment.reason,
                                    }}
                                />
                            </Flex>
                        )}
                    </Panel>
                </Col>
            </Row>

            <COUCategoryDrawer
                open={drawerOpen}
                category={editing}
                onClose={() => setDrawerOpen(false)}
                onSaved={refresh}
            />
        </DockLayout>
    );
}
