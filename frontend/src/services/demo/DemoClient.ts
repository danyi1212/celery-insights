import { DemoEventsService } from "@services/demo/services/DemoEventsService"
import { DemoSettingsService } from "@services/demo/services/DemoSettingsService"
import { DemoTasksService } from "@services/demo/services/DemoTasksService"
import { DemoWorkersService } from "@services/demo/services/DemoWorkersService"

export default class DemoClient {
    tasks: DemoTasksService
    events: DemoEventsService
    settings: DemoSettingsService
    workers: DemoWorkersService

    constructor() {
        this.tasks = new DemoTasksService()
        this.events = new DemoEventsService()
        this.settings = new DemoSettingsService()
        this.workers = new DemoWorkersService()
    }
}
