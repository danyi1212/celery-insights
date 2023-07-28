/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { AxiosHttpRequest } from './core/AxiosHttpRequest';

import { EventsService } from './services/EventsService';
import { SearchService } from './services/SearchService';
import { SettingsService } from './services/SettingsService';
import { TasksService } from './services/TasksService';
import { WorkersService } from './services/WorkersService';

type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;

export class ServerClient {

    public readonly events: EventsService;
    public readonly search: SearchService;
    public readonly settings: SettingsService;
    public readonly tasks: TasksService;
    public readonly workers: WorkersService;

    public readonly request: BaseHttpRequest;

    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = AxiosHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? '',
            VERSION: config?.VERSION ?? '0.1.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });

        this.events = new EventsService(this.request);
        this.search = new SearchService(this.request);
        this.settings = new SettingsService(this.request);
        this.tasks = new TasksService(this.request);
        this.workers = new WorkersService(this.request);
    }
}

