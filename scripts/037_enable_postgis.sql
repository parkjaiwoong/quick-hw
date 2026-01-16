-- PostGIS 확장 활성화
-- POINT 타입과 ST_Y, ST_X 함수를 사용하기 위해 필요

-- PostGIS 확장이 이미 있는지 확인
DO $$
BEGIN
    -- PostGIS 확장 활성화 시도
    CREATE EXTENSION IF NOT EXISTS postgis;
    RAISE NOTICE 'PostGIS extension enabled successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'PostGIS extension may already exist or cannot be enabled: %', SQLERRM;
END $$;

-- 확장 확인
SELECT 
    extname, 
    extversion 
FROM pg_extension 
WHERE extname = 'postgis';

-- POINT 타입이 제대로 작동하는지 확인
-- 만약 PostGIS를 사용하지 않으려면 기본 PostgreSQL point 타입을 사용해야 함

