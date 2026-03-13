import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

interface SearchBoxControls {
    close: () => void
    focus: () => void
    open: () => void
}

interface SearchBoxControllerValue {
    closeSearch: () => void
    focusSearch: () => void
    openSearch: () => void
    registerSearchBox: (controls: SearchBoxControls) => () => void
}

const noop = () => undefined

const defaultControls: SearchBoxControls = {
    close: noop,
    focus: noop,
    open: noop,
}

const SearchBoxControllerContext = createContext<SearchBoxControllerValue | null>(null)

export const SearchBoxControllerProvider = ({ children }: { children: ReactNode }) => {
    const controlsRef = useRef<SearchBoxControls>(defaultControls)

    const value = useMemo<SearchBoxControllerValue>(
        () => ({
            closeSearch: () => controlsRef.current.close(),
            focusSearch: () => controlsRef.current.focus(),
            openSearch: () => controlsRef.current.open(),
            registerSearchBox: (controls) => {
                controlsRef.current = controls

                return () => {
                    if (controlsRef.current === controls) {
                        controlsRef.current = defaultControls
                    }
                }
            },
        }),
        [],
    )

    return <SearchBoxControllerContext.Provider value={value}>{children}</SearchBoxControllerContext.Provider>
}

export const useSearchBoxController = () => {
    const context = useContext(SearchBoxControllerContext)

    if (!context) {
        throw new Error("useSearchBoxController must be used within a SearchBoxControllerProvider")
    }

    return context
}
