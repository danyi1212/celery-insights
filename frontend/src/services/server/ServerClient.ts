/* istanbul ignore file */
import {AxiosHttpRequest} from "./core/AxiosHttpRequest"
/* tslint:disable */
/* eslint-disable */
import type {BaseHttpRequest} from "./core/BaseHttpRequest"
import type {OpenAPIConfig} from "./core/OpenAPI"

import {ApiService} from "./services/ApiService"

type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest

export class ServerClient {
    public readonly api: ApiService

    public readonly request: BaseHttpRequest

    constructor(
        config?: Partial<OpenAPIConfig>,
        HttpRequest: HttpRequestConstructor = AxiosHttpRequest
    ) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? "",
            VERSION: config?.VERSION ?? "0.1.0",
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? "include",
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        })

        this.api = new ApiService(this.request)
    }
}
