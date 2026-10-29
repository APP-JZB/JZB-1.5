alter table public.jzb_access_accounts drop constraint jzb_access_accounts_username_check;
alter table public.jzb_access_accounts add constraint jzb_access_accounts_username_check check(username is null or (char_length(username) between 3 and 30 and username ~ '^[[:alpha:]][[:alnum:]._-]{2,29}$'));
