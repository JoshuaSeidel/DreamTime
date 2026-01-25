# Troubleshooting

Solutions to common issues with DreamTime.

## Installation Issues

### Docker Container Won't Start

**Symptoms:**
- Container exits immediately
- "Error: Cannot find module" in logs

**Solutions:**

1. **Check logs:**
   ```bash
   docker-compose logs server
   ```

2. **Verify environment variables:**
   ```bash
   docker-compose config
   ```

3. **Rebuild containers:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **Check disk space:**
   ```bash
   df -h
   ```

### Database Migration Errors

**Symptoms:**
- "Migration failed" errors
- "Table already exists" errors

**Solutions:**

1. **For SQLite:**
   ```bash
   # Backup existing database
   cp data/database/dreamtime.db data/database/dreamtime.db.backup

   # Reset and remigrate
   docker-compose exec server npx prisma migrate reset
   ```

2. **For PostgreSQL:**
   ```bash
   # Connect to database
   docker-compose exec server npx prisma migrate status

   # Force apply migrations
   docker-compose exec server npx prisma migrate deploy
   ```

### Port Already in Use

**Symptoms:**
- "Error: listen EADDRINUSE"

**Solutions:**

1. **Find process using port:**
   ```bash
   lsof -i :3000
   ```

2. **Kill the process or change port:**
   ```env
   PORT=3001
   ```

---

## Authentication Issues

### Can't Log In

**Symptoms:**
- "Invalid credentials" error
- Login form doesn't submit

**Solutions:**

1. **Clear browser cache and cookies**
2. **Try incognito/private window**
3. **Check if account exists** (try password reset)
4. **Verify server is running:**
   ```bash
   curl http://localhost:3000/health
   ```

### Token Expired

**Symptoms:**
- Suddenly logged out
- "Unauthorized" errors

**Solutions:**

1. **Log out and log back in**
2. **Clear browser storage:**
   - Open DevTools > Application > Storage > Clear site data

3. **Check token expiry settings:**
   ```env
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   ```

### Passkey Not Working

**Symptoms:**
- "Passkey registration failed"
- "Authentication failed"

**Solutions:**

1. **Check browser support:**
   - Chrome 109+, Safari 16+, Firefox 122+

2. **Verify HTTPS:**
   - Passkeys require HTTPS (except localhost)

3. **Check WebAuthn configuration:**
   ```env
   CLIENT_URL=https://your-domain.com
   ```

4. **Re-register passkey:**
   - Settings > Security > Remove passkey
   - Settings > Security > Add passkey

---

## App Issues

### Dashboard Not Loading

**Symptoms:**
- Blank screen
- Endless loading spinner

**Solutions:**

1. **Refresh the page (pull down on mobile)**

2. **Check network connection**

3. **Clear app cache:**
   - If installed as PWA, reinstall
   - Clear browser cache

4. **Check browser console for errors:**
   - Open DevTools (F12) > Console

### Buttons Not Responding

**Symptoms:**
- Tapping buttons does nothing
- No feedback on button press

**Solutions:**

1. **Check if already in expected state:**
   - Can't "Put Down" if already in crib
   - Can't "Fell Asleep" if not in crib

2. **Refresh the dashboard**

3. **Check network tab for failed requests**

4. **Verify role permissions:**
   - Viewers cannot track sleep
   - Check Settings > Child > Your Role

### Time Displayed Wrong

**Symptoms:**
- Times show in wrong timezone
- Schedule seems off by hours

**Solutions:**

1. **Check your timezone setting:**
   - Settings > Profile > Timezone

2. **Verify device timezone:**
   - Phone/computer settings match

3. **Refresh after changing timezone**

---

## Schedule Issues

### Recommendations Seem Wrong

**Symptoms:**
- Nap recommended too early/late
- Bedtime doesn't match expectations

**Solutions:**

1. **Verify schedule configuration:**
   - Schedule > Wake Windows
   - Ensure values match your child's needs

2. **Check logged sleep times:**
   - History > Today's sessions
   - Verify all events were logged correctly

3. **Review sleep debt:**
   - Dashboard shows current sleep debt
   - Short naps → earlier bedtime

4. **Reset schedule to defaults:**
   - Schedule > Schedule Type > Select template

### Day Sleep Cap Incorrect

**Symptoms:**
- Cap shows wrong remaining time
- Naps not being counted

**Solutions:**

1. **Verify sessions are completed:**
   - Open sessions don't count toward cap
   - Ensure "Out of Crib" was tapped

2. **Check session dates:**
   - Sessions must be today's date
   - Check for timezone issues

3. **Manual cap adjustment:**
   - Schedule > Day Sleep Cap
   - Verify value in minutes (e.g., 210 = 3.5 hours)

### Transition Not Progressing

**Symptoms:**
- Stuck at same target time
- Progress not updating

**Solutions:**

1. **Check transition settings:**
   - Schedule > Transition > Current settings

2. **Verify push interval:**
   - May be set to longer interval
   - Try "Push Now" if ready

3. **End and restart transition:**
   - Schedule > Transition > End Transition
   - Start new transition

---

## Notification Issues

### Not Receiving Notifications

**Symptoms:**
- No push notifications
- Reminders not arriving

**Solutions:**

1. **Check app permissions:**
   - iOS: Settings > DreamTime > Notifications
   - Android: Settings > Apps > DreamTime > Notifications

2. **Check browser permissions:**
   - Chrome: Settings > Privacy > Site Settings > Notifications

3. **Verify in DreamTime:**
   - Settings > Notifications > Enabled

4. **Test notifications:**
   - Settings > Notifications > Send Test

5. **Reinstall PWA:**
   - Remove from home screen
   - Reinstall from browser

### Notifications Delayed

**Symptoms:**
- Notifications arrive late
- Timing is inconsistent

**Solutions:**

1. **Disable battery optimization (Android):**
   - Settings > Apps > DreamTime > Battery > Unrestricted

2. **Keep app in background:**
   - Don't force-close the app

3. **Check Focus/Do Not Disturb modes:**
   - Notifications blocked during focus modes

---

## Sync Issues

### Data Not Syncing

**Symptoms:**
- Changes not appearing on other devices
- Outdated information shown

**Solutions:**

1. **Pull to refresh dashboard**

2. **Check network connection**

3. **Log out and log back in**

4. **Verify same account on both devices**

### Offline Changes Lost

**Symptoms:**
- Logged sleep while offline
- Data missing after reconnecting

**Solutions:**

1. **Check offline queue:**
   - Open DevTools > Application > IndexedDB

2. **Force sync:**
   - Go online and refresh
   - Background sync should trigger

3. **Prevention:**
   - Enable "Keep app running" in browser

---

## Data Issues

### Missing Sleep Sessions

**Symptoms:**
- Sessions not in history
- Data disappeared

**Solutions:**

1. **Check date filter:**
   - History may be filtered to specific date range

2. **Verify correct child selected:**
   - Check child dropdown

3. **Check session status:**
   - Open sessions may not appear in history

4. **Database backup check:**
   - `data/database/dreamtime.db.backup`

### Incorrect Analytics

**Symptoms:**
- Totals don't add up
- Charts show wrong data

**Solutions:**

1. **Verify all sessions are completed:**
   - Open sessions excluded from analytics

2. **Check timezone settings:**
   - Sessions may be counting for wrong day

3. **Refresh analytics page**

4. **Clear browser cache**

---

## Performance Issues

### App Running Slow

**Symptoms:**
- Slow page loads
- Laggy interactions

**Solutions:**

1. **Clear browser cache**

2. **Reinstall PWA**

3. **Check server resources:**
   ```bash
   docker stats
   ```

4. **Optimize database:**
   ```bash
   docker-compose exec server npx prisma db execute --stdin <<< "VACUUM;"
   ```

### High Memory Usage

**Symptoms:**
- Browser tab using lots of memory
- Server container memory high

**Solutions:**

1. **Restart the app/browser**

2. **Restart server container:**
   ```bash
   docker-compose restart server
   ```

3. **Check for memory leaks:**
   - DevTools > Performance > Memory

---

## Server Issues

### Server Crashes

**Symptoms:**
- Container restarting frequently
- Intermittent 502 errors

**Solutions:**

1. **Check logs:**
   ```bash
   docker-compose logs -f server
   ```

2. **Check resource limits:**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
   ```

3. **Increase memory if needed:**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 1G
   ```

### Database Connection Lost

**Symptoms:**
- "Database connection failed"
- Intermittent errors

**Solutions:**

1. **For SQLite:**
   - Check disk space
   - Check file permissions

2. **For PostgreSQL:**
   - Verify database server is running
   - Check connection string
   - Test connection manually

---

## Getting Help

### Collecting Debug Information

Before reporting issues, gather:

1. **Server logs:**
   ```bash
   docker-compose logs server > server.log
   ```

2. **Browser console:**
   - Open DevTools (F12) > Console
   - Copy any errors

3. **Network requests:**
   - Open DevTools > Network
   - Filter to failed requests

4. **System info:**
   - OS and version
   - Browser and version
   - DreamTime version

### Reporting Issues

1. Go to [GitHub Issues](https://github.com/JoshuaSeidel/DreamTime/issues)
2. Search for existing issues
3. Create new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Debug information

---

## Reset & Recovery

### Full Reset (Last Resort)

**Warning: This deletes all data!**

```bash
# Stop containers
docker-compose down

# Remove volumes
docker-compose down -v

# Remove data directory
rm -rf data/

# Rebuild and start
docker-compose up -d --build
```

### Restore from Backup

```bash
# Stop server
docker-compose stop server

# Restore database
cp /backup/dreamtime.db data/database/dreamtime.db

# Restart server
docker-compose start server
```

