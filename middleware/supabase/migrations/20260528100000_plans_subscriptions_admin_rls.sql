-- Superadmin: gestionar planes, límites y suscripciones desde el panel

CREATE POLICY subscriptions_superadmin_manage ON public.subscriptions
  FOR ALL
  USING (public.current_user_role() = 'superadmin')
  WITH CHECK (public.current_user_role() = 'superadmin');

CREATE POLICY plans_superadmin_manage ON public.plans
  FOR ALL
  USING (public.current_user_role() = 'superadmin')
  WITH CHECK (public.current_user_role() = 'superadmin');

CREATE POLICY plan_limits_superadmin_manage ON public.plan_limits
  FOR ALL
  USING (public.current_user_role() = 'superadmin')
  WITH CHECK (public.current_user_role() = 'superadmin');
