export function getCurrentUserId(req) {
    return req.session?.user?.id || req.user?._id || req.user?.id || null;
}
