import { DemoEventsService } from "@services/demo/services/demo-events-service"
import { DemoSearchService } from "@services/demo/services/demo-search-service"
import { DemoSettingsService } from "@services/demo/services/demo-settings-service"
import { DemoTasksService } from "@services/demo/services/demo-tasks-service"
import { DemoWorkersService } from "@services/demo/services/demo-workers-service"

export default class DemoClient {
    tasks: DemoTasksService
    events: DemoEventsService
    settings: DemoSettingsService
    workers: DemoWorkersService
    search: DemoSearchService

    constructor() {
        this.tasks = new DemoTasksService()
        this.events = new DemoEventsService()
        this.settings = new DemoSettingsService()
        this.workers = new DemoWorkersService()
        this.search = new DemoSearchService()
    }
}
