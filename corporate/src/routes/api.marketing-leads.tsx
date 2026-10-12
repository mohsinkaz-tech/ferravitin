import {createFileRoute} from '@tanstack/react-router';
import {handleMarketingLeads} from '@/lib/marketing-api.server';
export const Route=createFileRoute('/api/marketing-leads')({server:{handlers:{GET:({request})=>handleMarketingLeads(request),POST:({request})=>handleMarketingLeads(request)}}});
