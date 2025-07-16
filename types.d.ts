// types.d.ts
declare module 'firebase' {
    // This prevents the old firebase types from conflicting
}

declare module 'istanbul-lib-report' {
    // This prevents istanbul type errors
}

// If you need to declare any other modules that don't have types
declare module '*.png' {
    const value: any;
    export default value;
}

declare module '*.jpg' {
    const value: any;
    export default value;
}

declare module '*.jpeg' {
    const value: any;
    export default value;
}

declare module '*.svg' {
    const value: any;
    export default value;
}