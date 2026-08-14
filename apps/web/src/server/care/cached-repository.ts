import "server-only";
import { cache } from "react";
import { getProviderByCcn } from "./repository";

export const getProviderByCcnForPage = cache(getProviderByCcn);
