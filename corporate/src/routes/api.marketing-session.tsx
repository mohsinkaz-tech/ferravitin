import {createFileRoute} from '@tanstack/react-router';
import {handleAdminSession} from '@/lib/marketing-api.server';
export const Route=createFileRoute('/api/marketing-session')({server:{handlers:{GET:({request})=>handleAdminSession(request),POST:({request})=>handleAdminSession(request),DELETE:({request})=>handleAdminSession(request)}}});
