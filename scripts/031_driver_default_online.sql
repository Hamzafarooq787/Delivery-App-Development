-- New drivers should show as online by default until they explicitly go
-- offline themselves — only the DEFAULT changes here, existing drivers'
-- current is_online value is left untouched.
alter table driver_profiles alter column is_online set default true;
