import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/internal/orders')({
  head:()=>({meta:[{title:'Private ordering | BioScience Global'},{name:'robots',content:'noindex, nofollow'}]}),
  component:Orders,
});
function Orders(){return <main className="bsg-section"><p className="bsg-kicker">Private ordering</p><h1>Purchase orders are awaiting activation</h1><p>Approved partners will receive private access to review an order, sign through Adobe Acrobat Sign and use secure hosted payment.</p><p>Your public enquiry is nonbinding. It does not create an order, contract or payment obligation.</p><a className="bsg-button" href="/contact">Send a business enquiry</a></main>;}
