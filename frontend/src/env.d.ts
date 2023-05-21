/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_DEMO_MODE: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}