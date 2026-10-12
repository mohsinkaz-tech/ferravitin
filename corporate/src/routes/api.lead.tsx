import {createFileRoute} from '@tanstack/react-router';
import {handleContact} from '@/lib/contact-handler.server';
export const Route=createFileRoute('/api/lead')({server:{handlers:{POST:({request})=>handleContact(request)}}});
