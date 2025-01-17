import { Injectable } from '@angular/core';
import { AnalyticsBrowser } from '@segment/analytics-next';
import {
  ApEdition,
  ApEnvironment,
  ApFlagId,
  TelemetryEvent,
  UserWithoutPassword,
} from '@activepieces/shared';
import posthog from 'posthog-js';

import { FlagService } from '../service/flag.service';
import { Observable, map, of, switchMap, take } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { productFruits } from 'product-fruits';

@Injectable({
  providedIn: 'root',
})
export class TelemetryService {
  productFruitsInitialized = false;
  analytics: AnalyticsBrowser;

  constructor(private flagService: FlagService, private http: HttpClient) { }

  init(user: UserWithoutPassword) {
    this.flagService.getAllFlags().subscribe((flags) => {
      if (flags[ApFlagId.TELEMETRY_ENABLED] === true) {
        if (!this.analytics) {
          this.analytics = AnalyticsBrowser.load({
            writeKey: 'Znobm6clOFLZNdMFpZ1ncf6VDmlCVSmj',
          });
          this.analytics.addSourceMiddleware(({ payload, next }) => {
            const path = payload?.obj?.properties?.['path'];
            const ignoredPaths = ['/embed'];
            if (ignoredPaths.includes(path)) {
              return;
            }
            next(payload);
          });
        }

        const currentVersion =
          (flags[ApFlagId.CURRENT_VERSION] as string) || '0.0.0';
        const environment = (flags[ApFlagId.ENVIRONMENT] as string) || '0.0.0';
        this.analytics.identify(user.id, {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          activepiecesVersion: currentVersion,
          activepiecesEnvironment: environment,
        });

        this.analytics.ready(() => {
          posthog.init('phc_7F92HoXJPeGnTKmYv0eOw62FurPMRW9Aqr0TPrDzvHh', {
            autocapture: false,
            capture_pageview: false,
            segment: (window as any).analytics,
            loaded: () => this.analytics.page(),
          });

          posthog.identify(user.id, {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            activepiecesVersion: currentVersion,
            activepiecesEnvironment: environment,
          });

          posthog.onFeatureFlags((featureFlags) => {
            if (featureFlags.includes('beta-react')) {
              console.log('featureFlags', featureFlags);
              const token = window.localStorage.getItem('token'); // Fetch the token
              const currentUser = window.localStorage.getItem('currentUser'); // Fetch the currentUser
              setTimeout(() => {
                if (token && currentUser) {
                  const currentUserEncoded = encodeURIComponent(currentUser);
                  // Redirect to beta.activepieces.com with token and currentUser as query params
                  window.location.href = `https://beta.activepieces.com/switch-to-beta?token=${token}&currentUser=${currentUserEncoded}`;
                } else {
                  console.error('Token or currentUser is missing.');
                }
              }, 2000);
            }
          });
        });
      }

      if (flags[ApFlagId.EDITION] === ApEdition.CLOUD) {
        this.initializePf(user);
      }
    });
  }

  reset() {
    if (this.analytics) {
      this.analytics.reset();
    }
  }

  capture(event: TelemetryEvent) {
    this.flagService
      .getAllFlags()
      .pipe(take(1))
      .subscribe((flags) => {
        if (flags[ApFlagId.TELEMETRY_ENABLED] === true) {
          this.analytics.track(event.name, event.payload);
        }
      });
  }

  isFeatureEnabled(feature: string): Observable<boolean> {
    return this.flagService.getAllFlags().pipe(
      map((flags) => {
        if (flags[ApFlagId.ENVIRONMENT] === ApEnvironment.DEVELOPMENT) {
          return true;
        }
        if (!flags[ApFlagId.TELEMETRY_ENABLED]) {
          return false;
        }
        return posthog.isFeatureEnabled(feature) || false;
      })
    );
  }
  savePiecesSearch(request: {
    search: string;
    target: 'steps' | 'triggers' | 'both';
    insideTemplates: boolean;
    email: string;
  }) {
    return this.isTelemetryEnabled().pipe(
      switchMap((isTelemetryEnabled) => {
        if (!isTelemetryEnabled) {
          return of(void 0);
        }
        return this.http.post(
          'https://cloud.activepieces.com/api/v1/webhooks/C6khe7pYMdiLPrBpVIWZg',
          {
            ...request,
            email: request.email,
          }
        );
      })
    );
  }

  private isTelemetryEnabled(): Observable<boolean> {
    return this.flagService.getAllFlags().pipe(
      take(1),
      map((flags) => {
        return flags[ApFlagId.TELEMETRY_ENABLED] === true;
      })
    );
  }
  // BEGIN EE
  initializePf(user: UserWithoutPassword) {
    if (!this.productFruitsInitialized) {
      productFruits.init(
        'cLCwk9nBPS1DBBiE',
        'en',
        {
          username: user.id,
          email: user.email,
          firstname: user.firstName,
          lastname: user.lastName,
          signUpAt: user.created,
        },
        { disableLocationChangeDetection: false }
      );
      productFruits.safeExec(() => {
        console.log('PF is Initialized');
        this.productFruitsInitialized = true;
      });
    }
  }
  // END EE
}
