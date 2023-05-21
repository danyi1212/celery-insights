import { resetState } from "@stores/useStateStore"
import { simulateWorkflow, SimulatorTaskOptions } from "@utils/simulator/taskSimulator"
import { simulateWorker } from "@utils/simulator/workerSimulator"
import React, { useEffect } from "react"
import { useQueryClient } from "react-query"

const ORDER_WORKFLOW: SimulatorTaskOptions = {
    name: "submit_order",
    children: [
        {
            name: "update_inventory",
            children: [
                {
                    name: "create_shipment",
                    children: [{ name: "generate_sales_report" }, { name: "notify_user" }],
                },
            ],
        },
        { name: "create_invoice", children: [{ name: "notify_user" }] },
    ],
}

const USER_REGISTRATION_WORKFLOW: SimulatorTaskOptions = {
    name: "register_user",
    children: [
        {
            name: "validate_user_data",
            errorRate: 25,
            children: [
                {
                    name: "create_user_account",
                    children: [
                        { name: "store_user_data" },
                        {
                            name: "generate_user_credentials",
                            children: [{ name: "send_welcome_email" }],
                        },
                        { name: "generate_sales_report" },
                    ],
                },
            ],
        },
        { name: "log_user_registration" },
    ],
}

const PRODUCT_UPLOAD_WORKFLOW: SimulatorTaskOptions = {
    name: "upload_product",
    children: [
        {
            name: "validate_product_data",
            errorRate: 40,
            children: [
                {
                    name: "store_product_data",
                    children: [{ name: "generate_product_id" }, { name: "store_product_images" }],
                },
                { name: "update_product_catalogue" },
            ],
        },
    ],
}

const PAYMENT_PROCESSING_WORKFLOW: SimulatorTaskOptions = {
    name: "process_payment",
    children: [
        {
            name: "validate_payment_method",
            errorRate: 60,
            children: [
                {
                    name: "execute_transaction",
                    children: [{ name: "debit_customer_account" }, { name: "credit_merchant_account" }],
                },
                { name: "generate_sales_report" },
                { name: "notify_user" },
            ],
        },
        { name: "log_transaction" },
    ],
}

const DemoSimulator: React.FC = () => {
    const queryClient = useQueryClient()

    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log("Starting simulator...")
        resetState()
        queryClient.invalidateQueries().then()
        const cancelCallbacks = [
            simulateWorker("worker@1", 123),
            simulateWorker("worker@2", 123),
            simulateWorker("worker@3", 123),
            simulateWorkflow(ORDER_WORKFLOW, 30 * 1000),
            simulateWorkflow(PAYMENT_PROCESSING_WORKFLOW, 30 * 1000),
            simulateWorkflow(PRODUCT_UPLOAD_WORKFLOW, 120 * 1000),
            simulateWorkflow(USER_REGISTRATION_WORKFLOW, 120 * 1000),
        ]

        return () => {
            // eslint-disable-next-line no-console
            console.log("Stopping simulator...")
            cancelCallbacks.forEach((callback) => callback())
            resetState()
            queryClient.invalidateQueries().then()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return <></>
}
export default DemoSimulator
