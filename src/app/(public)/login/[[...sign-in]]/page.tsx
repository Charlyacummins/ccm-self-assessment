import { SignIn } from '@clerk/nextjs';
export default function Page() { return(
    <section className='min-h-screen'>
    <div className="flex min-h-screen items-center justify-center"><SignIn  /></div>
</section>
); }