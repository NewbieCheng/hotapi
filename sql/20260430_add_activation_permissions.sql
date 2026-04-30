-- activation_keys 新增权限 JSON 字段（兼容旧数据）
ALTER TABLE public.activation_keys
ADD COLUMN IF NOT EXISTS permissions jsonb;

-- 可选：给新记录默认空权限（保持 null 也可，null 表示旧版/全权限）
-- ALTER TABLE public.activation_keys
-- ALTER COLUMN permissions SET DEFAULT NULL;

COMMENT ON COLUMN public.activation_keys.permissions IS
'插件权限映射 JSON。为空表示不下发权限字段（兼容旧版客户端）。';
