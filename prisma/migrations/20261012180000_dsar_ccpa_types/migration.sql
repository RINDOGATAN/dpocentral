-- California (CCPA) request types without a GDPR counterpart: the request to
-- opt out of the sale or sharing of personal information (Civ. Code
-- 1798.120) and the request to limit the use and disclosure of sensitive
-- personal information (Civ. Code 1798.121). Requests to know, delete and
-- correct use ACCESS, ERASURE and RECTIFICATION. Additive only.
ALTER TYPE "DSARType" ADD VALUE 'OPT_OUT_SALE_SHARING';
ALTER TYPE "DSARType" ADD VALUE 'LIMIT_SENSITIVE_PI';
