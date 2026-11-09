import React from "react";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { useTranslation } from "react-i18next";
import { message } from "antd";

import { QueryHeader } from "@Turtle/Utils/Http";

// Create a default instance
const turxios = axios.create();

// ErrorText extracts the most useful human readable text from an axios error.
// The backend returns upstream failures (e.g. Yahoo HTTP 429) as HTTP 500 with
// a plain-text body, so we prefer the body over the generic axios message.
export function ErrorText(error: any): string {
    const data = error?.response?.data;
    if (typeof data === "string" && data.trim() !== "") {
        return data;
    }
    if (data && typeof data === "object") {
        if (data.error) return String(data.error);
        if (data.why) return String(data.why);
        if (data.message) return String(data.message);
    }
    if (error?.message) return error.message;
    return "Request failed";
}

export function TurxiosProvider() {
    const [messageApi, contextHolder] = message.useMessage();

    const [t] = useTranslation();

    function responseInterceptor(response) {
        return response;
    }

    function errorInterceptor(error: AxiosError) {
        if (error.response && error.response.status === 401) {
            messageApi.error(t("Unauthorized"));
        } else if (error.response && error.response.status === 404) {
            messageApi.error(t("404 - not found"));
        } else {
            console.error(error);

            messageApi.error({
                content: ErrorText(error),
                duration: 6,
            });
        }

        return Promise.reject(error);
    }

    React.useEffect(() => {
        const interceptorResponse = turxios.interceptors.response.use(
            responseInterceptor,
            errorInterceptor,
        );
        return () => {
            turxios.interceptors.response.eject(interceptorResponse);
        };
    }, []);

    return <>{contextHolder}</>;
}

// PostForm posts arbitrary form fields (strings or JSON-serialised values).
export async function PostForm<T = any>(
    route: string,
    fields: Record<string, any>,
    config?: AxiosRequestConfig<any>,
): Promise<T> {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (value instanceof Blob) {
            form.set(key, value);
        } else if (typeof value === "string") {
            form.set(key, value);
        } else if (typeof value === "number" || typeof value === "boolean") {
            form.set(key, String(value));
        } else {
            form.set(key, JSON.stringify(value));
        }
    });
    return (await turxios.post<T>(route, form, config)).data;
}

export async function PostEntity(
    route: string,
    data: any,
    config?: AxiosRequestConfig<any>,
) {
    const form = new FormData();
    form.set("data", JSON.stringify(data.ToJson ? data.ToJson() : data));
    return await turxios.post(route, form, config);
}

export async function QueryEntities(
    route: string,
    query: any,
    clazz,
    config?: AxiosRequestConfig<any>,
): Promise<Array<any>> {
    const data = (
        await turxios.get<Array<any>>(route, {
            ...config,
            headers: {
                ...QueryHeader(query),
            },
        })
    ).data;

    return (data ?? []).map((val) => {
        const tmp = new clazz();
        tmp.FromJson(val);
        return tmp;
    });
}

export async function GetEntity(
    route: string,
    uid: string,
    clazz,
    config?: AxiosRequestConfig<any>,
): Promise<any | null> {
    const data = (
        await turxios.get<any>(route, {
            ...config,
            params: {
                uid: uid,
            },
        })
    ).data;

    if (data) {
        const tmp = new clazz();
        tmp.FromJson(data);
        return tmp;
    } else {
        return null;
    }
}

export async function GetJson<T = any>(
    route: string,
    params?: Record<string, any>,
): Promise<T> {
    return (await turxios.get<T>(route, { params })).data;
}

export async function DeleteEntity(
    route: string,
    uid: string,
    config?: AxiosRequestConfig<any>,
) {
    return await turxios.delete(route, {
        ...config,
        params: {
            uid: uid,
        },
    });
}

export default turxios;
