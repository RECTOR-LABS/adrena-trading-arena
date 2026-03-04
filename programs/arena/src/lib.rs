use anchor_lang::prelude::*;

declare_id!("PBPaxmk2fFuvXFqiTM4c6FmuEP4tr8eK8wpa4HroVq6");

#[program]
pub mod arena {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
