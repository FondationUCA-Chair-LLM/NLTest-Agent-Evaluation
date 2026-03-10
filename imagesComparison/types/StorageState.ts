export type StorageState = {
    cookies: Cookie[];
    origins: Origins[];
};

export type Cookie = {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
}

export type Origins = {
    origin: string;
    localStorage: LocalStorage[];
}

export type LocalStorage = { name: string; value: string };