import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import {adminHeaders} from './lib/marketing-auth.server';

const marketingPrivacy = createMiddleware().server(async ({request,next}) => {
  const result=await next();
  const path=new URL(request.url).pathname;
  if(path==='/internal/marketing'||path.startsWith('/api/marketing-'))for(const [name,value] of Object.entries(adminHeaders))result.response.headers.set(name,value);
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, errorMiddleware, marketingPrivacy],
}));
