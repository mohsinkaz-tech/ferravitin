import {test,expect} from 'bun:test';
import {contactConfig} from '../src/lib/contact-config.server';
import {adminConfig} from '../src/lib/marketing-auth.server';
test('simulation blocks production contact and marketing secret resolution before any SDK request',async()=>{
  const previous=process.env.PURCHASE_ORDER_MODE;
  process.env.PURCHASE_ORDER_MODE='simulation';
  try{
    await expect(contactConfig()).rejects.toThrow('Contact delivery disabled');
    await expect(adminConfig()).rejects.toThrow('Marketing access disabled');
  }finally{
    if(previous===undefined)delete process.env.PURCHASE_ORDER_MODE;else process.env.PURCHASE_ORDER_MODE=previous;
  }
});
